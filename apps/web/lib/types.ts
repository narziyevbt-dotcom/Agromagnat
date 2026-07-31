/** Mirrors the backend DTOs. Money and volume stay strings end to end. */

export type QuantityUnit = 'kg' | 't' | 'dona' | 'quti' | 'qop' | 'l' | 'ga' | 'xizmat';
export type PriceUnit = QuantityUnit;

export type ListingStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'sold'
  | 'expired'
  | 'blocked';

export type DeliveryOption = 'none' | 'pickup' | 'delivery' | 'both';

export interface Region {
  id: string;
  nameUz: string;
  nameRu: string;
  slug: string;
}

export interface District {
  id: string;
  nameUz: string;
  nameRu: string;
  slug: string;
  regionId: string;
}

export interface Category {
  id: string;
  nameUz: string;
  nameRu: string;
  slug: string;
  icon: string | null;
  unitDefault: QuantityUnit;
  isFeatured: boolean;
  sortOrder: number;
}

export interface ListingPhoto {
  id: string;
  url: string;
  thumbUrl: string | null;
  sortOrder: number;
  width: number | null;
  height: number | null;
}

export interface Seller {
  id: string;
  name: string | null;
  phone: string;
  isVerified: boolean;
  ratingAvg: string;
  ratingCount: number;
  salesCount: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string | null;
  status: ListingStatus;

  quantity: string;
  quantityUnit: QuantityUnit;
  price: string;
  priceUnit: PriceUnit;
  minOrder: string | null;
  wholesalePrice: string | null;

  categoryId: string;
  category?: Category;
  regionId: string;
  region?: Region;
  districtId: string;
  district?: District;

  harvestDate: string | null;
  delivery: DeliveryOption;
  seasonMonths: number[];

  isPromoted: boolean;
  promotedUntil: string | null;
  viewCount: number;
  callCount: number;
  favoriteCount: number;

  createdAt: string;
  expiresAt: string | null;

  photos?: ListingPhoto[];
  seller?: Seller;

  /** Set by the API when the request carried a token. */
  isFavorite?: boolean;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

export interface CurrentUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'user' | 'moderator' | 'admin';
  isBlocked: boolean;
  isVerified: boolean;
  ratingAvg: string;
  ratingCount: number;
  salesCount: number;
  region: Region | null;
  district: District | null;
}

export interface SellerStats {
  activeListings: number;
  totalViews: number;
  totalCalls: number;
  avgPrice: string | null;
  avgPriceUnit: string | null;
  viewsTrendPct: number | null;
}

export interface TrendPoint {
  /** "2026-07" */
  month: string;
  /** Median price per category slug; null where that month had no listings. */
  values: Record<string, number | null>;
}

export interface PriceTrend {
  categories: Array<{ slug: string; nameUz: string }>;
  points: TrendPoint[];
}

export type ListingSort = 'newest' | 'cheapest' | 'expensive';

export interface ListingFilters {
  categoryId?: string;
  regionId?: string;
  districtId?: string;
  sellerId?: string;
  priceMin?: number;
  priceMax?: number;
  quantityMin?: number;
  verifiedOnly?: boolean;
  withDelivery?: boolean;
  q?: string;
  sort?: ListingSort;
  cursor?: string;
  limit?: number;
}

/* ----------------------------------------------------------------- chat */

export interface ChatParticipant {
  id: string;
  name: string | null;
  phone: string;
  isVerified: boolean;
}

export interface ChatSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPhotoUrl: string | null;
  listingPrice: string | null;
  listingPriceUnit: PriceUnit | null;
  counterpart: ChatParticipant;
  /** Which side of the conversation the viewer is on. */
  role: 'buyer' | 'seller';
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  type: 'text' | 'image' | 'system';
  body: string;
  clientId: string | null;
  readAt: string | null;
  createdAt: string;
  /** Set locally on an optimistic message that has not been acknowledged yet. */
  pending?: boolean;
}

export interface MessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

/* --------------------------------------------------------------- reviews */

export interface Review {
  id: string;
  listingId: string;
  authorId: string;
  sellerId: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  author?: { id: string; name: string | null };
  listing?: { id: string; title: string };
}

export type RatingBreakdown = Record<'1' | '2' | '3' | '4' | '5', number>;

export interface SellerReviews {
  items: Review[];
  total: number;
  /** Two decimals, computed over the visible reviews only. */
  average: string;
  breakdown: RatingBreakdown;
}

/* ---------------------------------------------------------------- admin */

export interface AdminOverview {
  totalUsers: number;
  newUsers7d: number;
  activeListings: number;
  pendingListings: number;
  openReports: number;
  totalViews: number;
  totalCalls: number;
}

export interface AdminPage<T> {
  items: T[];
  total: number;
}

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'user' | 'moderator' | 'admin';
  isVerified: boolean;
  isBlocked: boolean;
  ratingAvg: string;
  salesCount: number;
  createdAt: string;
}

export type ReportReason =
  | 'scam'
  | 'wrong_category'
  | 'wrong_price'
  | 'already_sold'
  | 'prohibited'
  | 'spam'
  | 'other';

export interface AdminReport {
  id: string;
  reason: ReportReason;
  comment: string | null;
  status: 'open' | 'resolved' | 'rejected';
  resolutionNote: string | null;
  createdAt: string;
  listing?: Listing;
  reporter?: AdminUser;
}
