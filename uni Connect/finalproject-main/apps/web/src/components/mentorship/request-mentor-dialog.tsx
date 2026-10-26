"use client";

import { Check, Clock, Handshake, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, TextArea, TextInput } from "@/components/forms/field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { REQUEST_MESSAGE_MAX, REQUEST_MESSAGE_MIN, type MentorshipStatus } from "@/lib/mentorship";
import { cn } from "@/lib/utils";
import { requestMentorship } from "@/server/actions/mentorship";

/**
 * The Request button on a mentor card. When the
 * viewer can't ask, it stays disabled and says why (capacity, privacy, an open request).
 */
export function RequestMentorButton({
  mentorId,
  mentorName,
  myRequestStatus,
  blockReason,
  showReason = true,
  className,
}: {
  mentorId: string;
  mentorName: string;
  myRequestStatus: MentorshipStatus | null;
  blockReason: string | null;
  /** Off when the card already says why (e.g. "Full at the moment"). */
  showReason?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();
  const first = mentorName.split(" ")[0];

  if (myRequestStatus === "accepted") {
    return (
      <Link
        href="/messages"
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), className)}
      >
        <MessageCircle data-icon="inline-start" /> Your mentor · Message
      </Link>
    );
  }
  if (myRequestStatus === "pending") {
    return (
      <Link
        href="/mentorship?tab=outgoing"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      >
        <Clock data-icon="inline-start" /> Request sent
      </Link>
    );
  }
  if (blockReason) {
    return (
      <div className={cn("space-y-1", className)}>
        <Button size="sm" variant="outline" disabled className="w-full sm:w-auto">
          <Handshake data-icon="inline-start" /> Request mentorship
        </Button>
        {showReason && <p className="text-xs text-muted-foreground">{blockReason}.</p>}
      </div>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestMentorship({ mentorId, topic, message });
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Request sent.");
      setOpen(false);
      setTopic("");
      setMessage("");
      setErrors({});
      router.refresh();
    });
  }

  const remaining = message.trim().length;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className={className} />}>
        <Handshake data-icon="inline-start" /> Request mentorship
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ask {first} to mentor you</DialogTitle>
            <DialogDescription>
              {first} will see your name, department and this message. If they accept, a private
              chat opens here. Nobody shares phone numbers.
            </DialogDescription>
          </DialogHeader>
          <Field
            id="request-topic"
            label="What would you like help with?"
            error={errors.topic}
            hint="A few words, like “Choosing a final-year project”."
          >
            <TextInput
              id="request-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={100}
              autoFocus
              {...describedBy("request-topic", errors.topic, true)}
            />
          </Field>
          <Field
            id="request-message"
            label="Message"
            error={errors.message}
            hint={
              remaining < REQUEST_MESSAGE_MIN
                ? `At least ${REQUEST_MESSAGE_MIN} characters (${remaining} so far).`
                : `${remaining}/${REQUEST_MESSAGE_MAX} characters`
            }
          >
            <TextArea
              id="request-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={REQUEST_MESSAGE_MAX}
              rows={5}
              placeholder="Say where you are in your studies and what you're stuck on."
              {...describedBy("request-message", errors.message, true)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? (
                "Sending…"
              ) : (
                <>
                  <Check data-icon="inline-start" /> Send request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
