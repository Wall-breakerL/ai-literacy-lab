import { cn } from "@/lib/cn";
import { useDeliverablesTracker } from "@/hooks/use-deliverables-tracker";
import type { SessionEvent } from "@/domain";
import type { ApartmentDeliverables, BrandDeliverables } from "@/hooks/use-deliverables-tracker";

interface DeliverablesProgressProps {
  sceneId: string;
  events: SessionEvent[];
}

export function DeliverablesProgress({ sceneId, events }: DeliverablesProgressProps) {
  const tracker = useDeliverablesTracker(sceneId, events);

  if (!tracker) return null;

  if (sceneId === "apartment-tradeoff") {
    const apartment = tracker as ApartmentDeliverables;
    const items = [
      apartment.mainRecommendation,
      apartment.backupOption,
      apartment.verificationQuestions,
    ];
    const doneCount = items.filter((i) => i.done).length;

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-lab-muted">交付进度</p>
          <span className="text-[11px] text-lab-muted">
            {doneCount}/{items.length}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li className="flex items-center gap-2" key={item.id}>
              {item.done ? (
                <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0 text-lab-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
              <span
                className={cn(
                  "text-[12px]",
                  item.done ? "text-emerald-200/90" : "text-lab-muted/70",
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (sceneId === "brand-naming-sprint") {
    const brand = tracker as BrandDeliverables;
    const items = [
      brand.finalName,
      brand.backupName,
      brand.reason,
      brand.tagline,
    ];
    const doneCount = items.filter((i) => i.done).length;

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-lab-muted">交付进度</p>
          <span className="text-[11px] text-lab-muted">
            {doneCount}/{items.length}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li className="flex items-center gap-2" key={item.id}>
              {item.done ? (
                <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0 text-lab-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
              <span
                className={cn(
                  "text-[12px]",
                  item.done ? "text-emerald-200/90" : "text-lab-muted/70",
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
