import { useCallback, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ProductGrid } from "./ProductGrid";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useProducts } from "../../hooks/useProducts";
import { useDebounce } from "../../hooks/useDebounce";
import type { ProductFilterState, SortOption } from "../../store/productFilter.store";
import { qk } from "../../lib/api/query-client";
import { CategoryService, type CategoryNode } from "../../lib/services/category.service";
import { SearchService } from "../../lib/services/product.service";
import { colors } from "../../theme/tokens";

// The heading area is a fixed height: the title switches between one line
// ("All products") and two ('Search results for "…"'), and a header that changes
// size mid-scroll makes the list re-measure and leaves a gap under it.
const HEADER_H = 58;
const HEADER_H_WITH_SUBTITLE = 76;

const SORTS: { key: SortOption; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "name_asc", label: "Name: A–Z" },
  { key: "name_desc", label: "Name: Z–A" },
];

function CategoryTree({
  nodes,
  selected,
  onSelect,
  depth = 0,
}: {
  nodes: CategoryNode[];
  selected?: string;
  onSelect: (slug?: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <View>
      {nodes.map((n) => {
        const hasChildren = (n.children?.length ?? 0) > 0;
        const on = selected === n.slug;
        const open = expanded[n.id];
        return (
          <View key={n.id}>
            <View className="flex-row items-center" style={{ paddingLeft: depth * 14 }}>
              {hasChildren ? (
                <Pressable onPress={() => setExpanded((e) => ({ ...e, [n.id]: !e[n.id] }))} hitSlop={8} className="p-1">
                  <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={14} color={colors.muted} />
                </Pressable>
              ) : (
                <View className="w-6" />
              )}
              <Pressable onPress={() => onSelect(on ? undefined : n.slug)} className="flex-1 py-2">
                <Text className={on ? "font-jakarta-semibold text-primary" : "text-text"}>{n.name}</Text>
              </Pressable>
              {on ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
            </View>
            {hasChildren && open ? (
              <CategoryTree nodes={n.children!} selected={selected} onSelect={onSelect} depth={depth + 1} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

interface Props {
  /** State source — the global store (Shop) or a local one (Pre-Order). */
  filter: ProductFilterState;
  /** Constrain results to pre-order products. */
  basePreOrder?: boolean;
  /** Enable auto-focusing the search input when arriving from the home search bar. */
  autoFocusFromHome?: boolean;
  /** Heading shown when there is no active search/category. */
  defaultTitle: string;
  /** Optional line under the heading. */
  subtitle?: string;
}

/**
 * The shared product-listing surface: search box + suggestions + Sort/Filter
 * (with bottom sheets) + an infinite product grid. Used by the Shop tab and the
 * Pre-Order tab so both share one identical header.
 */
export function ProductListing({ filter, basePreOrder, autoFocusFromHome, defaultTitle, subtitle }: Props) {
  const debouncedSearch = useDebounce(filter.search, 400);

  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [minInput, setMinInput] = useState(filter.priceMin?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(filter.priceMax?.toString() ?? "");

  const inputRef = useRef<TextInput>(null);
  const focusSearch = filter.focusSearch;
  const setFocusSearch = filter.setFocusSearch;

  // Auto-focus the input when arriving from the home search bar (Shop only).
  useFocusEffect(
    useCallback(() => {
      if (autoFocusFromHome && focusSearch) {
        const t = setTimeout(() => inputRef.current?.focus(), 350);
        setFocusSearch(false);
        return () => clearTimeout(t);
      }
    }, [autoFocusFromHome, focusSearch, setFocusSearch])
  );

  const categories = useQuery({ queryKey: qk.categories, queryFn: () => CategoryService.getTree() });

  const suggestQuery = useDebounce(filter.search, 200);
  const suggestions = useQuery({
    queryKey: ["search-suggestions", basePreOrder ? "preorder" : "all", suggestQuery],
    queryFn: () => SearchService.getSuggestions(suggestQuery),
    enabled: focused && suggestQuery.trim().length >= 2,
  });
  const showSuggestions = focused && suggestQuery.trim().length >= 2 && (suggestions.data?.length ?? 0) > 0;

  const query = useProducts({
    search: debouncedSearch || undefined,
    category: filter.category,
    sort: filter.sort,
    priceMin: filter.priceMin,
    priceMax: filter.priceMax,
    inStockOnly: filter.inStockOnly,
    preOrder: basePreOrder || undefined,
  });

  const products = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);

  const flatCategories = useMemo(() => {
    const out: CategoryNode[] = [];
    const walk = (ns: CategoryNode[]) => ns.forEach((n) => { out.push(n); if (n.children) walk(n.children); });
    walk(categories.data ?? []);
    return out;
  }, [categories.data]);

  const categoryName = useMemo(() => {
    if (!filter.category) return null;
    return flatCategories.find((c) => c.slug === filter.category)?.name ?? null;
  }, [filter.category, flatCategories]);

  const searching = !!debouncedSearch;

  const title = debouncedSearch
    ? `Search results for "${debouncedSearch}"`
    : categoryName || defaultTitle;

  const hasActiveFilters = !!filter.category || filter.priceMin != null || filter.priceMax != null || filter.inStockOnly;

  // Stable identities so the memoized grid isn't re-rendered on every keystroke.
  const listHeader = useMemo(
    () => (
      <View
        className="justify-center px-4 pb-2"
        style={{ height: subtitle ? HEADER_H_WITH_SUBTITLE : HEADER_H }}
      >
        <Text className="text-center text-xl font-jakarta-bold text-primary" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-center text-xs text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    ),
    [title, subtitle]
  );

  const refetch = query.refetch;
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const hasNextPage = query.hasNextPage;
  const fetchNextPage = query.fetchNextPage;
  const onEndReached = useCallback(() => {
    if (hasNextPage) fetchNextPage();
  }, [hasNextPage, fetchNextPage]);

  const emptyTitle = debouncedSearch ? "No results" : basePreOrder ? "No pre-order products yet" : "No products found";
  const emptySubtitle = debouncedSearch
    ? `Nothing matches "${debouncedSearch}".`
    : basePreOrder
      ? "Check back soon for items available to reserve."
      : undefined;

  const applyPrice = () => {
    filter.setPriceRange(minInput ? Number(minInput) : undefined, maxInput ? Number(maxInput) : undefined);
    setFilterOpen(false);
  };

  return (
    <>
      <View className="gap-3 px-4 pb-2 pt-2">
        <View className="flex-row items-center rounded-lg border border-border bg-surface px-3">
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            ref={inputRef}
            value={filter.search}
            onChangeText={filter.setSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onSubmitEditing={() => {
              setFocused(false);
              Keyboard.dismiss();
            }}
            placeholder="Search products"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 px-2 py-3 text-base text-text"
            returnKeyType="search"
          />
          {filter.search ? (
            <Pressable onPress={() => filter.setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Suggestions */}
        {showSuggestions ? (
          <View className="rounded-lg border border-border bg-surface">
            {suggestions.data!.slice(0, 6).map((s, i) => (
              <Pressable
                key={`${s.slug}-${i}`}
                onPress={() => {
                  filter.setSearch(s.name);
                  setFocused(false);
                  Keyboard.dismiss();
                }}
                className={`flex-row items-center gap-2 px-3 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <Ionicons name="search-outline" size={14} color={colors.muted} />
                <Text numberOfLines={1} className="flex-1 text-sm text-text">{s.name}</Text>
                {s.category ? <Text className="text-xs text-muted">in {s.category}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setSortOpen(true)}
            disabled={searching}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-border bg-surface py-2.5 ${searching ? "opacity-40" : ""}`}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.text} />
            <Text className="font-jakarta-medium text-text">Sort</Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterOpen(true)}
            disabled={searching}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-border bg-surface py-2.5 ${searching ? "opacity-40" : ""}`}
          >
            <Ionicons name="options-outline" size={16} color={colors.text} />
            <Text className="font-jakarta-medium text-text">Filter</Text>
            {hasActiveFilters ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
          </Pressable>
        </View>

        {/* The search endpoint ranks the whole catalogue and takes no filters,
            so say so rather than showing controls that quietly do nothing. */}
        {searching ? (
          <Text className="text-center text-xs text-muted">
            Sorting and filters don&apos;t apply to search results.
          </Text>
        ) : null}
      </View>

      <ProductGrid
        products={products}
        isLoading={query.isLoading}
        isError={query.isError}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        loadingMore={query.isFetchingNextPage}
        hasMore={hasNextPage}
        ListHeaderComponent={listHeader}
        emptyTitle={emptyTitle}
        emptySubtitle={emptySubtitle}
      />

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {SORTS.map((s) => {
          const active = filter.sort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                filter.setSort(s.key);
                setSortOpen(false);
              }}
              className="flex-row items-center justify-between py-3"
            >
              <Text className={active ? "font-jakarta-semibold text-primary" : "text-text"}>{s.label}</Text>
              {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        {/* Category tree */}
        <Text className="mb-1 font-jakarta-medium text-text">Category</Text>
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => filter.setCategory(undefined)} className="flex-row items-center py-2 pl-6">
            <Text className={!filter.category ? "flex-1 font-jakarta-semibold text-primary" : "flex-1 text-text"}>All categories</Text>
            {!filter.category ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
          </Pressable>
          <CategoryTree nodes={categories.data ?? []} selected={filter.category} onSelect={filter.setCategory} />
        </ScrollView>

        {/* In stock only */}
        <Pressable className="mt-3 flex-row items-center justify-between" onPress={() => filter.setInStockOnly(!filter.inStockOnly)}>
          <Text className="font-jakarta-medium text-text">In stock only</Text>
          <Switch value={filter.inStockOnly} onValueChange={filter.setInStockOnly} trackColor={{ true: colors.primary }} />
        </Pressable>

        {/* Price */}
        <Text className="mb-2 mt-4 font-jakarta-medium text-text">Price range (₹)</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input placeholder="Min" keyboardType="numeric" value={minInput} onChangeText={setMinInput} />
          </View>
          <View className="flex-1">
            <Input placeholder="Max" keyboardType="numeric" value={maxInput} onChangeText={setMaxInput} />
          </View>
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button
              label="Clear"
              variant="outline"
              onPress={() => {
                setMinInput("");
                setMaxInput("");
                filter.setPriceRange(undefined, undefined);
                filter.setCategory(undefined);
                filter.setInStockOnly(false);
                setFilterOpen(false);
              }}
            />
          </View>
          <View className="flex-1">
            <Button label="Apply" onPress={applyPrice} />
          </View>
        </View>
      </Sheet>
    </>
  );
}
