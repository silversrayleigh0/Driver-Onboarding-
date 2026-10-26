import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  ChevronRight, 
  ExternalLink,
  Eye,
  FileCheck,
  FileX,
  RefreshCw,
  ArrowLeft,
  Truck,
  MapPin,
  User as UserIcon
} from 'lucide-react';
import { Button, Card, Input, cn } from './Common';
import { DriverProfile, DriverDocument, OnboardingStatus } from '../types';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';

export const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<OnboardingStatus | 'all'>('all');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'drivers'));
    const unsub = onSnapshot(q, (snap) => {
      setDrivers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as DriverProfile)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    setRejectingDocId(null);
    setRejectionReason('');
    if (selectedDriver) {
      const unsub = onSnapshot(collection(db, 'drivers', selectedDriver.uid, 'documents'), (snap) => {
        setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as DriverDocument)));
      });
      return unsub;
    }
  }, [selectedDriver]);

  const updateDocStatus = async (docId: string, status: 'approved' | 'rejected', reason?: string) => {
    if (!selectedDriver) return;
    await updateDoc(doc(db, 'drivers', selectedDriver.uid, 'documents', docId), {
      status,
      rejectionReason: reason || null
    });
  };

  const updateDriverStatus = async (status: OnboardingStatus) => {
    if (!selectedDriver) return;
    await updateDoc(doc(db, 'drivers', selectedDriver.uid), {
      status,
      updatedAt: new Date().toISOString()
    });
    setSelectedDriver(prev => prev ? { ...prev, status } : null);
  };

  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = d.fullName?.toLowerCase().includes(search.toLowerCase()) || d.mobileNumber?.includes(search);
    const matchesFilter = filter === 'all' || d.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack} className="p-2 h-10 w-10">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Admin Dashboard</h1>
              <p className="text-sm text-zinc-500">Manage driver onboarding applications</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input 
                placeholder="Search drivers..." 
                className="pl-10 w-64 h-10" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="h-10 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="registration_started">Started</option>
              <option value="documents_submitted">Submitted</option>
              <option value="verification_in_progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-3">
            {filteredDrivers.map(d => (
              <Card 
                key={d.uid} 
                className={cn(
                  'cursor-pointer transition-all hover:border-brand-light',
                  selectedDriver?.uid === d.uid ? 'border-brand ring-1 ring-brand' : ''
                )}
              >
                <div className="p-4" onClick={() => setSelectedDriver(d)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-zinc-900">{d.fullName || 'Unnamed Driver'}</p>
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                      d.status === 'approved' ? 'bg-brand-light text-brand' :
                      d.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-zinc-100 text-zinc-600'
                    )}>
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-zinc-500 gap-3">
                    <span className="flex items-center"><Truck className="w-3 h-3 mr-1" /> {d.vehicleType || 'N/A'}</span>
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {d.city || 'N/A'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="col-span-8">
            {selectedDriver ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-zinc-900">{selectedDriver.fullName}</h2>
                        <p className="text-sm text-zinc-500">{selectedDriver.mobileNumber} • {selectedDriver.city}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => updateDriverStatus('rejected')} className="text-red-600 hover:bg-red-50">Reject All</Button>
                      <Button onClick={() => updateDriverStatus('approved')}>Approve Application</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Driver Details</h3>
                      <div className="space-y-2">
                        <DetailRow label="Vehicle" value={selectedDriver.vehicleType} />
                        <DetailRow label="Closed Body" value={selectedDriver.isClosedVehicle ? 'Yes' : 'No'} />
                        <DetailRow label="Reg Number" value={selectedDriver.vehicleRegNumber} />
                        <DetailRow label="Experience" value={`${selectedDriver.experienceYears} years`} />
                        <DetailRow label="Bank A/C" value={selectedDriver.bankAccount} />
                        <DetailRow label="IFSC" value={selectedDriver.ifscCode} />
                        <DetailRow label="UPI ID" value={selectedDriver.upiId} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Zones</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDriver.preferredZones?.map(z => (
                          <span key={z} className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-medium text-zinc-600">{z}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  {documents.map(doc => (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-zinc-900 uppercase">{doc.type.replace(/_/g, ' ')}</p>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => updateDocStatus(doc.id, 'approved')}
                            className={cn('p-1.5 rounded-lg transition-colors', doc.status === 'approved' ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-brand-light')}
                          >
                            <FileCheck className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setRejectingDocId(doc.id);
                              setRejectionReason(doc.rejectionReason || '');
                            }}
                            className={cn('p-1.5 rounded-lg transition-colors', doc.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-red-100')}
                          >
                            <FileX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="aspect-video bg-zinc-100 rounded-xl overflow-hidden relative group mb-3">
                        <img src={doc.filePath} alt={doc.type} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setViewingImageUrl(doc.filePath)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium w-full h-full"
                        >
                          <Eye className="w-4 h-4 mr-2" /> Inspect Image
                        </button>
                      </div>

                      {['vehicle_front', 'vehicle_side', 'vehicle_cargo'].includes(doc.type) && doc.status !== 'approved' && (
                        <Button 
                          onClick={() => updateDocStatus(doc.id, 'approved')}
                          className="w-full mb-3 h-8 text-[10px] bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1.5" /> Confirm Vehicle Visible
                        </Button>
                      )}

                      {rejectingDocId === doc.id ? (
                        <div className="space-y-2">
                          <Input 
                            placeholder="Reason for rejection..." 
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="h-8 text-[10px] px-2"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button 
                              className="h-7 py-0 px-2 text-[10px] flex-1" 
                              onClick={() => {
                                updateDocStatus(doc.id, 'rejected', rejectionReason);
                                setRejectingDocId(null);
                                setRejectionReason('');
                              }}
                            >
                              Confirm Reject
                            </Button>
                            <Button 
                              variant="outline" 
                              className="h-7 py-0 px-2 text-[10px]" 
                              onClick={() => {
                                setRejectingDocId(null);
                                setRejectionReason('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : doc.rejectionReason && (
                        <div className="p-2 bg-red-50 rounded-lg text-[10px] text-red-600 border border-red-100">
                          <p className="font-bold uppercase mb-0.5">Rejection Reason:</p>
                          <p>{doc.rejectionReason}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-12 text-center">
                <Users className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Select a driver from the list to view their application details and documents.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Inspection Modal */}
      {viewingImageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 md:p-10"
          onClick={() => setViewingImageUrl(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <img 
              src={viewingImageUrl} 
              alt="Inspection" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-0 right-0 m-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={() => setViewingImageUrl(null)}
            >
              <XCircle className="w-8 h-8" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white text-xs font-medium">
              Click anywhere outside to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value?: string | number }) => (
  <div className="flex justify-between text-sm py-1 border-b border-zinc-50">
    <span className="text-zinc-500">{label}</span>
    <span className="font-medium text-zinc-900">{value || 'N/A'}</span>
  </div>
);
