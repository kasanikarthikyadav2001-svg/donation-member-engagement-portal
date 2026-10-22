import { useEffect, useState } from "react";
export function useList() {
  const [search, setSearchValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatusValue] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  return {
    search,
    setSearch: (s: string) => {
      setSearchValue(s);
      setPage(1);
    },
    page,
    setPage,
    status,
    setStatus: (s: string) => {
      setStatusValue(s);
      setPage(1);
    },
    query: `search=${encodeURIComponent(debounced)}&page=${page}&status=${status}`,
    debounced,
  };
}
