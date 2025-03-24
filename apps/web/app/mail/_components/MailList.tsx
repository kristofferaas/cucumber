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
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  // Combine all messages from all pages
  const allMessages = data?.pages.flatMap((page) => page.messages) || [];

  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allMessages.length + 1 : allMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height of each row in pixels
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
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allMessages.length,
    isFetchingNextPage,
    virtualItems,
  ]);

  if (status === "pending") {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (status === "error") {
    return <div className="text-center p-4">Error loading messages</div>;
  }

  if (allMessages.length === 0) {
    return (
      <div className="text-center p-4">
        No messages found or rate limited by Gmail API
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[calc(100vh-200px)] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allMessages.length - 1;
          const message = allMessages[virtualRow.index];

          return (
            <div
              key={isLoaderRow ? "loader" : message.id}
              data-index={virtualRow.index}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center w-full py-4">
                  {isFetchingNextPage
                    ? "Loading more..."
                    : "Nothing more to load"}
                </div>
              ) : (
                <MailItem message={message} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
