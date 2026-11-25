"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { InterviewForm, toForm } from "@/components/InterviewForm";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";
import { fetcher } from "@/lib/api";

export default function EditInterview() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR(`/api/interviews/${id}`, fetcher, { revalidateOnFocus: false });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={error?.message ?? "Interview not found."} />;
  return (<><PageHeader title={`Edit ${data.interview.research_id}`} /><InterviewForm mode="edit" id={id} initial={toForm(data.interview)} /></>);
}
