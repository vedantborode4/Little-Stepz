import { ScrollView, Text, View } from "react-native";

import { ScreenContainer } from "../layout/ScreenContainer";
import { Header } from "../layout/Header";
import { getPolicy, type PolicySlug, type PolicyBlock } from "@repo/content/index";

function Block({ block }: { block: PolicyBlock }) {
  if (block.type === "subheading") {
    return (
      <Text className="mt-3 text-base font-jakarta-semibold text-text">{block.text}</Text>
    );
  }

  if (block.type === "list") {
    return (
      <View className="gap-1.5">
        {block.items.map((item, i) => (
          <View key={i} className="flex-row gap-2">
            <Text className="text-sm text-muted">{"•"}</Text>
            <Text className="flex-1 text-sm leading-relaxed text-muted">{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  return <Text className="text-sm leading-relaxed text-muted">{block.text}</Text>;
}

export function PolicyScreen({ slug }: { slug: PolicySlug }) {
  const page = getPolicy(slug);

  return (
    <ScreenContainer bgClassName="bg-surface">
      <Header title={page.title} className="bg-surface" />
      <ScrollView className="bg-surface" contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}>
        {page.intro ? (
          <Text className="text-sm leading-relaxed text-muted">{page.intro}</Text>
        ) : null}

        {page.sections.map((section, si) => (
          <View key={si} className="gap-2">
            {section.heading ? (
              <Text className="text-lg font-jakarta-bold text-text">{section.heading}</Text>
            ) : null}
            {section.blocks.map((block, bi) => (
              <Block key={bi} block={block} />
            ))}
          </View>
        ))}

        <View className="h-6" />
      </ScrollView>
    </ScreenContainer>
  );
}
