import { City, VehicleType, TrainingModule } from './types';

export const CITIES: City[] = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruppur'];

export const VEHICLE_TYPES: VehicleType[] = ['Mini Truck', 'Pickup', 'Maxi Truck 407', 'LCV'];

export const CITY_ZONES: Record<City, string[]> = {
  'Chennai': ['Central', 'T Nagar', 'Tambaram', 'Ambattur', 'Anna Nagar', 'Guindy', 'Perambur', 'Porur', 'Velachery'],
  'Coimbatore': ['Gandhipuram', 'Peelamedu', 'RS Puram', 'Saibaba Colony', 'Singanallur', 'Ondipudur', 'Race Course'],
  'Madurai': ['Anna Nagar', 'KK Nagar', 'Sellur', 'Simmakkal', 'Tallakulam', 'Teppakulam'],
  'Tiruppur': ['Avinashi Road', 'Dharapuram Road', 'Kangayam Road', 'Palladam Road', 'Uthukuli Road']
};

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'm1',
    title: 'How Trip Requests Work',
    content: 'How a trip request appears on the driver app, accepting and declining trips, timeout window, and why being online during peak hours matters.',
    quiz: [
      {
        question: 'What happens if you don\'t respond to a trip request within the timeout window?',
        options: ['The trip is automatically accepted', 'The trip is passed to another driver', 'You get a fine'],
        correctIndex: 1
      }
    ]
  },
  {
    id: 'm2',
    title: 'TruckTaxi\'s Fare & Meter System',
    content: 'How the meter fare model works, rates by vehicle type, and how to see your per-trip earning.',
    quiz: [
      {
        question: 'Which vehicle type has the highest base fare?',
        options: ['Mini Truck', 'Pickup', 'LCV'],
        correctIndex: 2
      }
    ]
  }
  // Add more modules as needed
];

export const DOCUMENT_LABELS: Record<string, string> = {
  dl_front: 'Driving License - Front',
  dl_back: 'Driving License - Back',
  rc_book: 'RC Book',
  insurance: 'Insurance Certificate',
  puc: 'Pollution Certificate (PUC)',
  aadhaar_front: 'Aadhaar Card - Front',
  aadhaar_back: 'Aadhaar Card - Back',
  vehicle_front: 'Vehicle Photo - Front',
  vehicle_side: 'Vehicle Photo - Side',
  vehicle_cargo: 'Vehicle Photo - Cargo Area'
};
