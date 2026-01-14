export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Landmark {
  id: string;
  name: string;
  category: string;
  distance: number;
  location: Coordinates;
  description?: string;
  address?: string;
  rating?: number;
}

export interface LocationState {
  coordinates: Coordinates | null;
  error: string | null;
  loading: boolean;
}

export interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  currentLandmark: Landmark | null;
  narrative: string | null;
}
