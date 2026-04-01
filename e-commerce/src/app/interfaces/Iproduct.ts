import { ICategory } from "./ICategory"
import { IProductImage } from "./IProductImage"
import { IProductVariant } from "./IProductVariant"
import { IDiscount } from "./IDiscount"

export interface IProduct {
  id: string
  categoryId: string
  name: string
  slug: string
  description: string | null
  shortDesc: string | null
  brand: string | null
  basePrice: string
  isActive: boolean
  isFeatured: boolean
  isNewArrival: boolean
  weightGrams: number | null
  metaTitle: string | null
  metaDescription: string | null
  soldCount: number
  avgRating: string | null
  createdAt: string
  updatedAt: string
  category: ICategory
  images: IProductImage[]
  variants: IProductVariant[]
  discounts: IDiscount[]
}
