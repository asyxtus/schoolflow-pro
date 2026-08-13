import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClasses } from "@/lib/classes-admin.functions";

export function useClassOptions() {
  const fn = useServerFn(listClasses);
  return useQuery({
    queryKey: ["classes-list"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
