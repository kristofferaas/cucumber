"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useEffect } from "react";
import { MailItem } from "./MailItem";
import { fetchMessages } from "./fetch-messages";

export type ClerkUser = ReturnType<typeof useUser>["user"];

export function MailList({ token }: { token: string }) {
  const { user } = useUser();
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["messages"],
      queryFn: async ({ pageParam }) => {
        const response = await fetchMessages(token, user, pageParam);
        return response;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  // Combine all messages from all pages
  const allMessages =
    data?.pages.flatMap((page) => {
      return "messages" in page ? page.messages : [];
    }) ?? [];

  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allMessages.length + 1 : allMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Estimated height of each row in pixels
    gap: 10,
    paddingStart: 10,
    paddingEnd: 10,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Load more data when scrolling to the end
  useEffect(() => {
    const lastItem = virtualItems.at(-1);

    if (
      lastItem &&
      lastItem.index >= allMessages.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allMessages.length,
    isFetchingNextPage,
    virtualItems,
  ]);

  if (status === "pending") {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (status === "error") {
    return <div className="p-4 text-center">Error loading messages</div>;
  }

  if (allMessages.length === 0) {
    return (
      <div className="p-4 text-center">
        No messages found or rate limited by Gmail API
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[calc(100vh-3rem)] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allMessages.length - 1;
          const message = isLoaderRow
            ? undefined
            : allMessages[virtualRow.index];

          return (
            <div
              key={
                isLoaderRow
                  ? "loader"
                  : (message?.id ?? `row-${virtualRow.index}`)
              }
              data-index={virtualRow.index}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex w-full items-center justify-center py-4">
                  {isFetchingNextPage
                    ? "Loading more..."
                    : "Nothing more to load"}
                </div>
              ) : (
                message && <MailItem message={message} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
