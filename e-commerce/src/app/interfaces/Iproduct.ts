import { ICategory } from "./ICategory"
import { IProductImage } from "./IProductImage"
import { IProductVariant } from "./IProductVariant"

export interface IProduct {
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
  category: ICategory
  images: IProductImage[]
  variants: IProductVariant[]
  discounts: any[]
}
