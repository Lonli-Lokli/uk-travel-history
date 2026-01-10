import { redirect } from 'next/navigation';

/**
 * Legacy route - redirect to home page
 * The travel tracker is now at the root path
 */
export default function TravelPage() {
  redirect('/');
}
