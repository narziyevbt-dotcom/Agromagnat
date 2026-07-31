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
