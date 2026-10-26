export type Language = 'Tamil' | 'English';

export type City = 'Chennai' | 'Coimbatore' | 'Madurai' | 'Tiruppur';

export type VehicleType = 'Mini Truck' | 'Pickup' | 'Maxi Truck 407' | 'LCV';

export type OnboardingStatus = 
  | 'registration_started' 
  | 'documents_pending'
  | 'documents_submitted' 
  | 'verification_in_progress' 
  | 'action_required' 
  | 'approved' 
  | 'rejected';

export interface DriverProfile {
  uid: string;
  fullName?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  city?: City;
  vehicleType?: VehicleType;
  isClosedVehicle?: boolean;
  vehicleRegNumber?: string;
  experienceYears?: number;
  preferredZones?: string[];
  bankAccount?: string;
  ifscCode?: string;
  upiId?: string;
  referral?: string;
  status: OnboardingStatus;
  currentStage: number;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType = 
  | 'dl_front' 
  | 'dl_back' 
  | 'rc_book' 
  | 'insurance' 
  | 'puc' 
  | 'aadhaar_front' 
  | 'aadhaar_back' 
  | 'vehicle_front' 
  | 'vehicle_side' 
  | 'vehicle_cargo';

export interface DriverDocument {
  id: string;
  driverId: string;
  type: DocumentType;
  filePath: string;
  status: 'uploaded' | 'approved' | 'rejected';
  rejectionReason?: string;
  uploadedAt: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  content: string;
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}
