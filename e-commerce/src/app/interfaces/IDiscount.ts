export interface IDiscount {
  type: 'percentage' | 'fixed_amount'
  value: string
  label: string | null
}
