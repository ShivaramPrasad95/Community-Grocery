export interface Item {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  barcode?: string | null;
  image_url?: string | null;
  image_emoji?: string | null;
  description?: string | null;
  is_new_arrival?: boolean;
  is_offer?: boolean;
  offer_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  item: Item;
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  flat: string;
  phone: string;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
}

export interface Order {
  id: string;
  customer_id?: string;
  customers?: Customer | null;
  items: OrderItem[];
  subtotal: number;
  delivery_charge?: number;
  total: number;
  delivery_time?: string;
  notes?: string | null;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  whatsapp_sent?: boolean;
  created_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  kind: 'new_arrival' | 'offer';
  image_url?: string | null;
  whatsapp_sent?: boolean;
  created_at?: string;
}

export interface ShopConfig {
  id: number;
  shop_name: string;
  currency: string;
  delivery_charge: number;
  minimum_order: number;
  admin_password_hash?: string;
  twilio_from_number?: string;
}
