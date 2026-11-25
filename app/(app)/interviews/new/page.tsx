import { InterviewForm } from "@/components/InterviewForm";
import { PageHeader } from "@/components/ui";

export default function NewInterview() {
  return (<><PageHeader title="New interview" subtitle="Record a real customer conversation." /><InterviewForm mode="create" /></>);
}
