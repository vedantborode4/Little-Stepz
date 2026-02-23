export interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  user: {
    name: string
  }
}

export interface PaginatedReviews {
  reviews: Review[]
  total: number
  page: number
  limit: number
  pages: number
}
