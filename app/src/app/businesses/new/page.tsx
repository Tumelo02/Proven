import { listOrganisations } from '@/lib/queries';
import { NewBusinessForm } from './form';

export default async function NewBusinessPage() {
  const organisations = await listOrganisations();
  return <NewBusinessForm organisations={organisations} />;
}
