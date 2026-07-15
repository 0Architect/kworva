export type TransactionType = 'buy' | 'borrow_rent' | 'hire' | 'split' | 'swap';
export type RequestStatus = 'open' | 'matched' | 'closed' | 'expired';
export type ResponseStatus = 'sent' | 'accepted' | 'declined';
export type ReportTarget = 'user' | 'request' | 'message';

export interface Profile {
  id: string;
  display_name: string;
  campus: string;
  area: string;
  bio_text: string | null;
  phone: string | null;
  phone_verified: boolean;
  rating_avg: number;
  deals_count: number;
  expo_push_token: string | null;
  is_active: boolean;
  consent_at: string | null;
  policy_version: string | null;
  created_at: string;
}

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CapacityTag {
  id: string;
  profile_id: string;
  label: string;
  category_id: string | null;
  created_at: string;
}

export interface Request {
  id: string;
  author_id: string;
  text: string;
  transaction_type: TransactionType;
  category_id: string | null;
  budget_text: string | null;
  area: string;
  status: RequestStatus;
  created_at: string;
  expires_at: string | null;
}

export interface Response {
  id: string;
  request_id: string;
  plug_id: string;
  message: string;
  price_text: string | null;
  status: ResponseStatus;
  created_at: string;
}

export interface Chat {
  id: string;
  request_id: string;
  buyer_id: string;
  plug_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  rater_id: string;
  ratee_id: string;
  request_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  user_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  created_at: string;
}

// Matching module interface — callers must only use this; never inline SQL
export interface RankedCandidate {
  plug_id: string;
  score: number;
  reason: string;
}
