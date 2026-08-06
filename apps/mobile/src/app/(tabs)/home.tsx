import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AppHeader } from "../../components/layout/AppHeader";
import { HeroBanner } from "../../components/home/HeroBanner";
import { AboutUs } from "../../components/home/AboutUs";
import { SectionHeader } from "../../components/home/SectionHeader";
import { PromoBannerRow } from "../../components/home/PromoBannerRow";
import { MidPromoBanner } from "../../components/home/MidPromoBanner";
import { BestSellers } from "../../components/home/BestSellers";
import { CategorySection } from "../../components/home/CategorySection";
import { PreOrderHome } from "../../components/home/PreOrderHome";
import { WhyChooseUs } from "../../components/home/WhyChooseUs";
import { WhyChooseLittleStepz } from "../../components/home/WhyChooseLittleStepz";
import { colors } from "../../theme/tokens";

export default function Home() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["banners"] }),
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  return (
    <ScreenContainer>
      {/* Fixed top header — logo, search, wishlist, cart */}
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View className="gap-8">
          {/* 1. Hero — flush under the header (no top gap) */}
          <HeroBanner />

          {/* 2. Categories */}
          <View className="gap-5">
            <SectionHeader title="Shop by Category" subtitle="Browse our full range of categories" />
            <PromoBannerRow />
          </View>

          {/* 3. Why Shop With Us */}
          <View className="gap-5">
            <SectionHeader title="Why Shop With Us" />
            <WhyChooseUs />
          </View>

          {/* 4. Best Sellers */}
          <View className="gap-5">
            <SectionHeader title="Best Sellers" subtitle="Our most-loved products" />
            <BestSellers sort="bestselling" />
          </View>

          {/* 5. Banner */}
          <MidPromoBanner />

          {/* 6. Pre-Order (self-hides when empty) */}
          <PreOrderHome />

          {/* 7. New Arrivals */}
          <View className="gap-5">
            <SectionHeader title="New Arrivals" subtitle="Fresh drops, just in" />
            <BestSellers sort="newest" />
          </View>

          {/* 8. Stunt Cars (slider, self-hides when empty) */}
          <CategorySection slug="stunt-cars" title="Stunt Cars" subtitle="Flips, spins and off-road tricks" />

          {/* 9. About Little Stepz */}
          <AboutUs />

          {/* 10. Licensed Cars (4×2 grid, self-hides when empty) */}
          <CategorySection
            slug="licensed-cars"
            title="Licensed Cars"
            subtitle="Officially licensed replicas"
            layout="grid"
            limit={8}
          />

          {/* 11. Our Advantage */}
          <WhyChooseLittleStepz />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
