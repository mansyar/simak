import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageCircle, Send, Trash2, CornerDownRight, X } from 'lucide-react';

import { useI18n } from '../../routes/__root';
import { authClient } from '../../lib/auth-client';
import {
  listDiscussionMessages,
  postDiscussionMessage,
  deleteOwnMessage,
} from '@/server/discussions';
import { isServerError } from '@/lib/errors';
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
import { ErrorState } from '@/components/ui/error-state';
import { MutationFeedback } from '@/components/ui/mutation-feedback';

interface DiscussionMessage {
  id: number;
  message: string;
  userId: string;
  authorName: string;
  authorRole: string;
  parentMessageId: number | null;
  createdAt: Date | null;
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
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
  const [postError, setPostError] = useState<string>();
  const [postSuccess, setPostSuccess] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [deleteSuccess, setDeleteSuccess] = useState<string>();

  const formSchema = z.object({
    message: z
      .string()
      .min(1, t('discussions.errors.required'))
      .max(2000, t('discussions.errors.tooLong')),
  });
  type FormValues = z.infer<typeof formSchema>;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: discussionKeys.list(checkpointId, 1),
    queryFn: async () => {
      const res = await listDiscussionMessages({
        data: { checkpointId, page: 1, limit: 100 },
      });
      if (isServerError(res)) {
        throw new Error(res.error.message);
      }
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
      const res = await postDiscussionMessage({
        data: {
          checkpointId,
          message: values.message,
          parentMessageId: replyTo ?? undefined,
        },
      });
      if (isServerError(res)) {
        throw new Error(res.error.message);
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
    onError: (_error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      setPostError(t('discussions.errors.postFailed'));
      setPostSuccess(undefined);
    },
    onSuccess: () => {
      setPostSuccess(t('discussions.success.posted'));
      setPostError(undefined);
      form.reset();
      setReplyTo(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discussionKeys.all() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const res = await deleteOwnMessage({
        data: { messageId },
      });
      if (isServerError(res)) {
        throw new Error(res.error.message);
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
    onError: (_error, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      setDeleteError(t('discussions.errors.deleteFailed'));
      setDeleteSuccess(undefined);
    },
    onSuccess: () => {
      setDeleteSuccess(t('discussions.success.deleted'));
      setDeleteError(undefined);
      setDeleteConfirmationId(null);
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
    setPostError(undefined);
    setPostSuccess(undefined);
    setDeleteError(undefined);
    setDeleteSuccess(undefined);
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

  if (isError) {
    return (
      <ErrorState
        title={t('errors.fetchFailed')}
        retryLabel={t('common.refresh')}
        onRetry={() => void refetch()}
      />
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
            <span>{msg.createdAt ? formatRelativeTime(msg.createdAt, locale) : ''}</span>
            {canDelete(msg) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteConfirmationId(msg.id);
                  setDeleteError(undefined);
                  setDeleteSuccess(undefined);
                }}
                aria-label={t('discussions.delete')}
              >
                <Trash2 className="size-4" />
              </Button>
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
          {deleteConfirmationId === msg.id && (
            <div
              role="alertdialog"
              aria-labelledby={`delete-message-${msg.id}-title`}
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <p id={`delete-message-${msg.id}-title`} className="font-medium">
                {t('discussions.deleteConfirm')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirmationId(null)}
                  disabled={deleteMutation.isPending}
                >
                  {t('discussions.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteError(undefined);
                    setDeleteSuccess(undefined);
                    deleteMutation.mutate(msg.id);
                  }}
                  loading={deleteMutation.isPending}
                >
                  {t('discussions.delete')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('discussions.title')}</h2>

      <MutationFeedback error={postError ?? deleteError} success={postSuccess ?? deleteSuccess} />

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
