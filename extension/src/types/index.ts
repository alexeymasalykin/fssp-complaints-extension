// Common types for FSSP Complaint extension

// === Complaint data (one row from Excel) ===

export interface Complaint {
  index: number;
  orgName: string;
  region: string;           // Субъект РФ (select value text)
  municipality: string;     // Муниципальное образование
  locality: string;         // Населенный пункт
  street: string;           // Улица
  house: string;            // Номер дома
  building: string;         // Номер корпуса
  apartment: string;        // Номер квартиры
  postalCode: string;       // Почтовый индекс
  appealType: string;       // Вид обращения (select)
  appealTopic: string;      // Тема обращения (select)
  territorialBody: string;  // Территориальный орган (select)
  structuralUnit: string;   // Структурное подразделение ФССП (select)
  fsspEmployee: string;     // Сотрудник ФССП
  appealText: string;       // Текст обращения
}

// === Fill result ===

export type FillStatus = 'pending' | 'filled' | 'submitted' | 'error';

export interface FillResult {
  status: FillStatus;
  timestamp: string | null;
  error: string | null;
}

// === Queue state ===

export type QueueState = 'idle' | 'ready' | 'filling' | 'completed';

export interface QueueData {
  complaints: Complaint[];
  currentIndex: number;
  results: FillResult[];
  state: QueueState;
}

// === Settings ===

export interface Settings {
  notifyOnComplete: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  notifyOnComplete: true,
};

// === Result stats ===

export interface ResultStats {
  total: number;
  filled: number;
  submitted: number;
  error: number;
  pending: number;
}
