export interface IProductImage {
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
