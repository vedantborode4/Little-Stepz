export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  title?: string | null;
  createdAt: string;
  user?: { name: string } | null;
  author?: { name: string } | null;
}

export interface PaginatedReviews {
  reviews: Review[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  averageRating?: number;
  total?: number;
}
