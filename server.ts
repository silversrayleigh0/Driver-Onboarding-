import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load firebase config for server-side use
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Admin
const bucketName = firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`;
admin.initializeApp({
  projectId: firebaseConfig.projectId,
  storageBucket: bucketName
});

// Get bucket with fallback logic
let bucket = admin.storage().bucket();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body limit for base64 images
  app.use(express.json({ limit: '20mb' }));

  // Create uploads folder if not exists
  const localUploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
    console.log(`Created local uploads directory: ${localUploadDir}`);
  }

  // Serve local uploads statically
  app.use("/uploads", express.static(localUploadDir));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/upload-proxy", async (req, res) => {
    try {
      const { base64, path: storagePath, contentType } = req.body;
      
      if (!base64 || !storagePath) {
        return res.status(400).json({ error: "Missing base64 or path" });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');

      // List of possible bucket names to try in order
      const possibleBuckets = [
        firebaseConfig.storageBucket,
        `${firebaseConfig.projectId}.firebasestorage.app`,
        `${firebaseConfig.projectId}.appspot.com`,
        firebaseConfig.projectId
      ].filter(Boolean); // Remove null/undefined

      let lastError: any = null;
      let successUrl: string | null = null;

      for (const bName of possibleBuckets) {
        try {
          console.log(`Attempting upload to bucket: ${bName}`);
          const currentBucket = admin.storage().bucket(bName);
          const file = currentBucket.file(storagePath);

          await file.save(buffer, {
            metadata: { 
              contentType: contentType || 'image/jpeg',
              cacheControl: 'public, max-age=31536000'
            }
          });

          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
          });

          successUrl = url;
          console.log(`Successfully uploaded to ${bName}`);
          break; // Exit loop on success
        } catch (err: any) {
          console.warn(`Failed with bucket ${bName}:`, err.message || err);
          lastError = err;
        }
      }

      if (successUrl) {
        return res.json({ url: successUrl });
      }

      // Firebase Storage uploads failed, fallback to local node.js local file write
      console.warn("All Firebase Storage attempts failed. Falling back to local container storage.");
      const cleanFileName = path.basename(storagePath).replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const uniqueFileName = `${Date.now()}_fallback_${cleanFileName}`;
      const localFilePath = path.join(localUploadDir, uniqueFileName);
      
      fs.writeFileSync(localFilePath, buffer);
      
      const localUrl = `/uploads/${uniqueFileName}`;
      console.log(`Saved successfully to local storage fallback: ${localUrl}`);
      return res.json({ url: localUrl });

    } catch (error: any) {
      console.error("Local/Server-side upload fallback failed. Full error details:", error);
      const errorMessage = error.message || "Unknown server error during file upload";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
