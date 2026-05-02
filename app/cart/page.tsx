import type { Metadata } from 'next';
import CartPage from '../components/CartPage/CartPage';

export const metadata: Metadata = {
  title: 'My Cart | Rajasthan Pipe Traders',
  description: 'Review your selected products and place your order with Rajasthan Pipe Traders.',
};

export default function CartRoute() {
  return <CartPage />;
}
