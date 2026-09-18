'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SegmentRules {
  tags: string[];
  sources: string[];
  min_orders: number | null;
  max_orders: number | null;
  min_ltv: number | null;
  max_ltv: number | null;
}

export const EMPTY_RULES: SegmentRules = {
  tags: [], sources: [], min_orders: null, max_orders: null, min_ltv: null, max_ltv: null,
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function SegmentRuleBuilder({
  rules, setRules, availableTags, availableSources, currencySymbol,
}: {
  rules: SegmentRules;
  setRules: (r: SegmentRules) => void;
  availableTags: string[];
  availableSources: string[];
  currencySymbol: string;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Tags <span className="text-xs">(any match)</span></Label>
        {availableTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No customer tags exist yet — add some from the Customers page first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Button key={tag} type="button" size="sm" variant={rules.tags.includes(tag) ? 'default' : 'outline'}
                onClick={() => setRules({ ...rules, tags: toggleInList(rules.tags, tag) })}>
                {tag}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Source <span className="text-xs">(any match)</span></Label>
        {availableSources.length === 0 ? (
          <p className="text-xs text-muted-foreground">No customer sources recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableSources.map((source) => (
              <Button key={source} type="button" size="sm" variant={rules.sources.includes(source) ? 'default' : 'outline'}
                className="capitalize" onClick={() => setRules({ ...rules, sources: toggleInList(rules.sources, source) })}>
                {source}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="seg-min-orders">Min orders</Label>
          <Input id="seg-min-orders" type="number" min={0} value={rules.min_orders ?? ''}
            onChange={(e) => setRules({ ...rules, min_orders: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seg-max-orders">Max orders</Label>
          <Input id="seg-max-orders" type="number" min={0} value={rules.max_orders ?? ''}
            onChange={(e) => setRules({ ...rules, max_orders: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seg-min-ltv">Min lifetime value ({currencySymbol})</Label>
          <Input id="seg-min-ltv" type="number" min={0} value={rules.min_ltv ?? ''}
            onChange={(e) => setRules({ ...rules, min_ltv: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seg-max-ltv">Max lifetime value ({currencySymbol})</Label>
          <Input id="seg-max-ltv" type="number" min={0} value={rules.max_ltv ?? ''}
            onChange={(e) => setRules({ ...rules, max_ltv: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
