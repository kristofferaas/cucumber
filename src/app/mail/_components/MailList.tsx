"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useEffect } from "react";
import { MailItem } from "./MailItem";
import { api } from "@/trpc/react";

export function MailList() {
  const parentRef = useRef<HTMLDivElement>(null);

  const [
    data,
    { fetchNextPage, hasNextPage, isFetchingNextPage, status, error },
  ] = api.gmail.infiniteMessages.useSuspenseInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: undefined,
      staleTime: 1000 * 60 * 5,
    },
  );

  const allMessages =
    data?.pages?.flatMap((page) => page?.messages ?? []) ?? [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allMessages.length + 1 : allMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    gap: 10,
    paddingStart: 10,
    paddingEnd: 10,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

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

  if (status === "error") {
    const errorMessage = error?.message ?? "Error loading messages";
    return <div className="p-4 text-center text-red-500">{errorMessage}</div>;
  }

  if (allMessages.length === 0) {
    return <div className="p-4 text-center">No messages found</div>;
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
