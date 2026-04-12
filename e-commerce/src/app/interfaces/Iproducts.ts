export interface Root {
  data: Daum[]
  meta: Meta
}

export interface Daum {
  id: string
  categoryId: string
  name: string
  slug: string
  description: string
  shortDesc: string
  brand: string
  basePrice: string
  isActive: boolean
  isFeatured: boolean
  isNewArrival: boolean
  weightGrams: any
  metaTitle: any
  metaDescription: any
  soldCount: number
  avgRating: string
  createdAt: string
  updatedAt: string
  category: Category
  images: Image[]
  variants: Variant[]
  discounts: Discount[]
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Image {
  id: string
  productId: string
  variantId: string | null
  url: string
  altText: string | null
  sortOrder: number
  isCover: boolean
  width: number | null
  height: number | null
  createdAt: string
}

export interface Variant {
  id: string
  size: string
  color: string
  colorHex: string
  priceOverride: any
  stockQty: number
}

export interface Discount {
  type: string
  value: string
  label: string
}

export interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}
