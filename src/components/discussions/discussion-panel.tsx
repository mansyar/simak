import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MessageCircle, Send, Trash2, CornerDownRight, X } from 'lucide-react';

import { useI18n } from '../../routes/__root';
import { authClient } from '../../lib/auth-client';
import {
  listDiscussionMessages,
  postDiscussionMessage,
  deleteOwnMessage,
} from '@/server/discussions';
import { discussionKeys } from '@/lib/query-keys';
import { formatRelativeTime } from '@/lib/format';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

interface DiscussionMessage {
  id: number;
  message: string;
  userId: string;
  authorName: string;
  authorRole: string;
  parentMessageId: number | null;
  createdAt: Date;
  deletedAt: Date | null;
}

interface DiscussionPanelProps {
  checkpointId: number;
  assignmentId: number;
  instructorView?: boolean;
}

const DELETION_WINDOW_MS = 15 * 60 * 1000;

export function DiscussionPanel({ checkpointId, instructorView = false }: DiscussionPanelProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { data: sessionData } = authClient.useSession();
  const currentUser = sessionData?.user;
  const userRole = (currentUser as { role?: string } | undefined)?.role ?? 'student';
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const formSchema = z.object({
    message: z
      .string()
      .min(1, t('discussions.errors.required'))
      .max(2000, t('discussions.errors.tooLong')),
  });
  type FormValues = z.infer<typeof formSchema>;

  const { data, isLoading } = useQuery({
    queryKey: discussionKeys.list(checkpointId, 1),
    queryFn: async () => {
      const res = await (
        listDiscussionMessages as unknown as (args: {
          data: { checkpointId: number; page: number; limit: number };
        }) => Promise<{ messages: DiscussionMessage[]; total: number }>
      )({
        data: { checkpointId, page: 1, limit: 100 },
      });
      return res;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: '' },
    mode: 'onSubmit',
  });

  const postMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await (
        postDiscussionMessage as unknown as (args: {
          data: { checkpointId: number; message: string; parentMessageId?: number };
        }) => Promise<{
          success: boolean;
          message?: DiscussionMessage;
          error?: { code: string; message: string };
        }>
      )({
        data: {
          checkpointId,
          message: values.message,
          parentMessageId: replyTo ?? undefined,
        },
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to post message');
      }
      return res;
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.all() });
      const previousEntries = queryClient.getQueriesData({ queryKey: discussionKeys.all() });
      if (currentUser) {
        queryClient.setQueriesData<{ messages: DiscussionMessage[]; total: number }>(
          { queryKey: discussionKeys.all() },
          (old) => {
            if (!old) return old;
            const tempMessage: DiscussionMessage = {
              id: Date.now(),
              message: values.message,
              userId: currentUser.id,
              authorName: currentUser.name ?? '',
              authorRole: userRole,
              parentMessageId: replyTo,
              createdAt: new Date(),
              deletedAt: null,
            };
            return {
              ...old,
              messages: [...old.messages, tempMessage],
              total: old.total + 1,
            };
          },
        );
      }
      return { previousEntries };
    },
    onError: (error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.all() });
      form.reset();
      setReplyTo(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const res = await (
        deleteOwnMessage as unknown as (args: { data: { messageId: number } }) => Promise<{
          success: boolean;
          error?: { code: string; message: string };
        }>
      )({
        data: { messageId },
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to delete message');
      }
      return res;
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: discussionKeys.all() });
      const previousEntries = queryClient.getQueriesData({ queryKey: discussionKeys.all() });
      queryClient.setQueriesData<{ messages: DiscussionMessage[]; total: number }>(
        { queryKey: discussionKeys.all() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m.id === messageId ? { ...m, deletedAt: new Date() } : m,
            ),
          };
        },
      );
      return { previousEntries };
    },
    onError: (error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.all() });
    },
  });

  const messages = data?.messages ?? [];
  const topLevelMessages = messages.filter((m) => m.parentMessageId === null);
  const getReplies = (parentId: number) => messages.filter((m) => m.parentMessageId === parentId);

  const canDelete = (msg: DiscussionMessage) => {
    if (!currentUser || msg.userId !== currentUser.id) return false;
    if (msg.deletedAt) return false;
    if (!msg.createdAt) return false;
    return Date.now() - new Date(msg.createdAt).getTime() < DELETION_WINDOW_MS;
  };

  const handleFormSubmit = (values: FormValues) => {
    postMutation.mutate(values);
  };

  const messageValue = form.watch('message');
  const isSendDisabled = !messageValue?.trim() || postMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">{t('discussions.loading')}</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const renderMessage = (msg: DiscussionMessage, isReply = false) => {
    const isOwnMessage = !!currentUser && msg.userId === currentUser.id;
    const windowExpired = isOwnMessage && !msg.deletedAt && msg.createdAt && !canDelete(msg);

    return (
      <div
        key={msg.id}
        data-role={msg.authorRole}
        data-reply={isReply || undefined}
        className={cn(
          'flex gap-2',
          msg.authorRole === 'instructor' ? 'flex-row-reverse' : 'flex-row',
          isReply && 'ml-8',
        )}
      >
        <Avatar name={msg.authorName} size="sm" />
        <div className="flex-1 space-y-1">
          {instructorView && (
            <span className="text-xs font-medium text-muted-foreground">{msg.authorName}</span>
          )}
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              msg.deletedAt
                ? 'bg-muted text-muted-foreground italic'
                : msg.authorRole === 'instructor'
                  ? 'bg-primary/10'
                  : 'bg-muted',
            )}
          >
            {msg.deletedAt ? t('discussions.deleted') : msg.message}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatRelativeTime(msg.createdAt, locale)}</span>
            {canDelete(msg) && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(msg.id)}
                className="hover:text-destructive"
                aria-label={t('discussions.delete')}
              >
                <Trash2 className="size-4" />
              </button>
            )}
            {windowExpired && <span>{t('discussions.deleteWindowExpired')}</span>}
            {!msg.deletedAt && (
              <button
                type="button"
                onClick={() => setReplyTo(msg.id)}
                className="hover:text-primary"
                aria-label={t('discussions.reply')}
              >
                <CornerDownRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('discussions.title')}</h3>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={t('discussions.empty.title')}
          description={t('discussions.empty.description')}
          compact
        />
      ) : (
        <ScrollArea maxHeight="400px" className="space-y-3">
          {topLevelMessages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {renderMessage(msg)}
              {getReplies(msg.id).map((reply) => renderMessage(reply, true))}
            </div>
          ))}
        </ScrollArea>
      )}

      {replyTo !== null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CornerDownRight className="size-4" />
          <span>{t('discussions.reply')}</span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="text-primary hover:underline"
            aria-label={t('discussions.cancel')}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-2">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder={t('discussions.placeholder')}
                    aria-label={t('discussions.placeholder')}
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSendDisabled} loading={postMutation.isPending}>
            <Send className="size-4" />
            {t('discussions.send')}
          </Button>
        </form>
      </Form>
    </div>
  );
}
