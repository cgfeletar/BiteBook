import "@/nativewind-setup";
import { CHEF_LEVELS, useProgressStore } from "@/src/store/useProgressStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import {
  Award,
  ChefHat,
  Clock,
  Flame,
  Globe,
  Plus,
  Target,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Cuisine data with flag emojis
const CUISINES = [
  { name: "Italian", flag: "🇮🇹", tag: "italian" },
  { name: "Mexican", flag: "🇲🇽", tag: "mexican" },
  { name: "Japanese", flag: "🇯🇵", tag: "japanese" },
  { name: "French", flag: "🇫🇷", tag: "french" },
  { name: "Thai", flag: "🇹🇭", tag: "thai" },
  { name: "Indian", flag: "🇮🇳", tag: "indian" },
  { name: "Greek", flag: "🇬🇷", tag: "greek" },
  { name: "Chinese", flag: "🇨🇳", tag: "chinese" },
  { name: "American", flag: "🇺🇸", tag: "american" },
  { name: "Mediterranean", flag: "🌊", tag: "mediterranean" },
];

// Preset challenge templates
const CHALLENGE_TEMPLATES = [
  {
    title: "Cook at Home Streak",
    description: "Cook a recipe 5 days in a row",
    target: 5,
    type: "streak_days" as const,
    metadata: { streakType: "consecutive" as const },
  },
  {
    title: "Breakfast Master",
    description: "Cook 10 breakfast recipes",
    target: 10,
    type: "tag_count" as const,
    metadata: { tag: "breakfast" },
  },
  {
    title: "Quick Cook",
    description: "Cook 5 recipes under 30 minutes",
    target: 5,
    type: "quick_meals" as const,
    metadata: { maxPrepTime: 30 },
  },
  {
    title: "Vegetarian Week",
    description: "Cook 7 vegetarian recipes",
    target: 7,
    type: "tag_count" as const,
    metadata: { tag: "vegetarian" },
  },
  {
    title: "World Traveler",
    description: "Cook recipes from 10 different cuisines",
    target: 10,
    type: "cuisine_count" as const,
  },
  {
    title: "Dessert Lover",
    description: "Cook 5 dessert recipes",
    target: 5,
    type: "tag_count" as const,
    metadata: { tag: "dessert" },
  },
  {
    title: "One Pot Meal Master",
    description: "Cook 5 one pot meal recipes",
    target: 5,
    type: "tag_count" as const,
    metadata: { tag: "one pot meal" },
  },
];

export default function ProgressScreen() {
  const recipes = useRecipeStore((state) => state.recipes);
  const cookingSessions = useProgressStore((state) => state.cookingSessions);
  const challenges = useProgressStore((state) => state.challenges);
  const removeChallenge = useProgressStore((state) => state.removeChallenge);
  const addChallenge = useProgressStore((state) => state.addChallenge);
  const updateChallengeProgress = useProgressStore(
    (state) => state.updateChallengeProgress
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  // Compute values with useMemo to avoid infinite loops
  const recipesCooked = useMemo(
    () => cookingSessions.length,
    [cookingSessions.length]
  );

  const timeCooking = useMemo(() => {
    const totalMinutes = cookingSessions.reduce(
      (sum, session) => sum + session.timeSpent,
      0
    );
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, [cookingSessions]);

  const chefLevel = useMemo(() => {
    let currentLevel = CHEF_LEVELS[0];
    let nextLevel = CHEF_LEVELS[1];

    for (let i = CHEF_LEVELS.length - 1; i >= 0; i--) {
      if (recipesCooked >= CHEF_LEVELS[i].threshold) {
        currentLevel = CHEF_LEVELS[i];
        if (i < CHEF_LEVELS.length - 1) {
          nextLevel = CHEF_LEVELS[i + 1];
        } else {
          nextLevel = {
            ...CHEF_LEVELS[i],
            threshold: CHEF_LEVELS[i].threshold + 50,
          };
        }
        break;
      }
    }

    const progress = recipesCooked - currentLevel.threshold;
    const progressNeeded = nextLevel.threshold - currentLevel.threshold;
    const progressPercentage = Math.min((progress / progressNeeded) * 100, 100);

    return {
      level: currentLevel.level,
      title: currentLevel.title,
      progress: progressPercentage,
      nextLevel: nextLevel.threshold,
    };
  }, [recipesCooked]);

  // Calculate cuisine counts from recipe tags
  const cuisineCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        const normalizedTag = tag.toLowerCase();
        const cuisine = CUISINES.find(
          (c) => c.tag.toLowerCase() === normalizedTag
        );
        if (cuisine) {
          counts[cuisine.name] = (counts[cuisine.name] || 0) + 1;
        }
      });
    });

    // Sort by count, descending
    return Object.entries(counts)
      .map(([name, count]) => {
        const cuisine = CUISINES.find((c) => c.name === name);
        return {
          name,
          flag: cuisine?.flag || "🌍",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 cuisines
  }, [recipes]);

  // Calculate recipes remaining to next level
  const recipesToNextLevel = chefLevel.nextLevel - recipesCooked;

  // Update challenge progress when recipes or cooking sessions change
  useEffect(() => {
    updateChallengeProgress(recipes);
  }, [recipes, cookingSessions, updateChallengeProgress]);

  const handleAddChallenge = (templateIndex: number) => {
    const template = CHALLENGE_TEMPLATES[templateIndex];
    addChallenge({
      title: template.title,
      description: template.description,
      target: template.target,
      current: 0,
      type: template.type,
      metadata: template.metadata,
    });
    setShowAddModal(false);
    setSelectedTemplate(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-3xl font-bold text-charcoal-gray mb-2">
              Progress
            </Text>
            <Text className="text-base text-charcoal-gray/60">
              Track your culinary journey and achievements
            </Text>
          </View>

          {/* Statistics Cards */}
          <View className="flex-row gap-4 mb-6">
            {/* Recipes Cooked Card */}
            <View className="flex-1 bg-white rounded-2xl p-4 border border-warm-sand/50">
              <View className="mb-3">
                <ChefHat size={24} color="#9CA3AF" />
              </View>
              <Text className="text-3xl font-bold text-charcoal-gray mb-1">
                {recipesCooked}
              </Text>
              <Text className="text-sm text-charcoal-gray/60">
                Recipes Cooked
              </Text>
            </View>

            {/* Time Cooking Card */}
            <View className="flex-1 bg-white rounded-2xl p-4 border border-warm-sand/50">
              <View className="mb-3">
                <Clock size={24} color="#9CA3AF" />
              </View>
              <Text className="text-3xl font-bold text-charcoal-gray mb-1">
                {timeCooking}h
              </Text>
              <Text className="text-sm text-charcoal-gray/60">
                Time Cooking
              </Text>
            </View>
          </View>

          {/* Chef Level Section */}
          <View
            className="rounded-2xl p-6 mb-6 overflow-hidden"
            style={{ backgroundColor: "#E7D8C9" }}
          >
            <View className="flex-row items-center mb-4">
              <View className="w-16 h-16 bg-dark-sage rounded-full items-center justify-center mr-4">
                <Award size={28} color="#FAF9F7" />
              </View>
              <View className="flex-1">
                <Text className="text-sm text-charcoal-gray/70 mb-1">
                  Level {chefLevel.level}
                </Text>
                <Text className="text-2xl font-bold text-charcoal-gray">
                  {chefLevel.title}
                </Text>
              </View>
              <Text className="text-sm text-charcoal-gray/70">
                {recipesCooked}/{chefLevel.nextLevel}
              </Text>
            </View>

            {/* Progress Bar */}
            <View className="mb-3">
              <View className="h-3 bg-white/30 rounded-full overflow-hidden">
                <View
                  className="h-full bg-dark-sage rounded-full"
                  style={{ width: `${chefLevel.progress}%` }}
                />
              </View>
            </View>

            <Text className="text-sm text-charcoal-gray/70">
              {recipesToNextLevel > 0
                ? `${recipesToNextLevel} more recipe${
                    recipesToNextLevel !== 1 ? "s" : ""
                  } to reach ${
                    CHEF_LEVELS.find((l) => l.threshold === chefLevel.nextLevel)
                      ?.title || "next level"
                  }`
                : "Max level reached!"}
            </Text>
          </View>

          {/* Culinary Passport Section */}
          <View className="bg-white rounded-2xl p-6 mb-6 border border-warm-sand/50">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Globe size={20} color="#3E3E3E" style={{ marginRight: 8 }} />
                <Text className="text-lg font-bold text-charcoal-gray">
                  Culinary Passport
                </Text>
              </View>
              <Text className="text-sm text-charcoal-gray/60">
                {cuisineCounts.length} cuisine
                {cuisineCounts.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {cuisineCounts.length > 0 ? (
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {cuisineCounts.map((cuisine) => (
                  <View
                    key={cuisine.name}
                    className="items-center"
                    style={{ width: "22%" }}
                  >
                    <View className="w-16 h-16 bg-soft-beige rounded-xl items-center justify-center mb-2">
                      <Text className="text-3xl">{cuisine.flag}</Text>
                    </View>
                    <Text className="text-xs font-semibold text-charcoal-gray text-center mb-1">
                      {cuisine.name}
                    </Text>
                    <Text className="text-xs text-charcoal-gray/60">
                      {cuisine.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-charcoal-gray/60 text-center py-4">
                Start cooking recipes from different cuisines to unlock your
                passport!
              </Text>
            )}
          </View>

          {/* Active Challenges Section */}
          <View className="bg-white rounded-2xl p-6 mb-6 border border-warm-sand/50">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Target size={20} color="#3E3E3E" style={{ marginRight: 8 }} />
                <Text className="text-lg font-bold text-charcoal-gray">
                  Active Challenges
                </Text>
              </View>
              <TouchableOpacity
                className="w-8 h-8 bg-dark-sage rounded-full items-center justify-center"
                activeOpacity={0.7}
                onPress={() => setShowAddModal(true)}
              >
                <Plus size={18} color="#FAF9F7" />
              </TouchableOpacity>
            </View>

            {challenges.length > 0 ? (
              <View className="gap-3">
                {challenges.map((challenge) => (
                  <View
                    key={challenge.id}
                    className="bg-soft-beige rounded-xl p-4 border border-warm-sand/50 relative"
                  >
                    <TouchableOpacity
                      className="absolute top-3 right-3 w-6 h-6 items-center justify-center"
                      onPress={() => removeChallenge(challenge.id)}
                      activeOpacity={0.7}
                    >
                      <X size={16} color="#9CA3AF" />
                    </TouchableOpacity>

                    <View className="flex-row items-start mb-3">
                      <View className="w-10 h-10 bg-redwood/20 rounded-full items-center justify-center mr-3">
                        <Flame size={20} color="#7A2E2A" />
                      </View>
                      <View className="flex-1 pr-8">
                        <Text className="text-base font-bold text-charcoal-gray mb-1">
                          {challenge.title}
                        </Text>
                        <Text className="text-sm text-charcoal-gray/60">
                          {challenge.description}
                        </Text>
                      </View>
                    </View>

                    <View className="mb-2">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm text-charcoal-gray/60">
                          Progress
                        </Text>
                        <Text className="text-sm font-semibold text-charcoal-gray">
                          {challenge.current}/{challenge.target}
                        </Text>
                      </View>
                      <View className="h-2 bg-white/50 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-dark-sage rounded-full"
                          style={{
                            width: `${Math.min(
                              (challenge.current / challenge.target) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="py-4">
                <Text className="text-sm text-charcoal-gray/60 text-center mb-3">
                  No active challenges. Tap the + button to add one!
                </Text>
                <TouchableOpacity
                  className="bg-soft-beige rounded-xl p-4 border border-warm-sand/50 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-sm font-semibold text-dark-sage">
                    Add Challenge
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Challenge Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-charcoal-gray">
                Add Challenge
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                className="w-8 h-8 items-center justify-center"
              >
                <X size={24} color="#3E3E3E" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-base text-charcoal-gray/70 mb-4">
                Choose a challenge to get started:
              </Text>

              <View className="gap-3">
                {CHALLENGE_TEMPLATES.map((template, index) => (
                  <TouchableOpacity
                    key={index}
                    className="bg-soft-beige rounded-xl p-4 border border-warm-sand/50"
                    activeOpacity={0.7}
                    onPress={() => handleAddChallenge(index)}
                  >
                    <Text className="text-base font-bold text-charcoal-gray mb-1">
                      {template.title}
                    </Text>
                    <Text className="text-sm text-charcoal-gray/60 mb-2">
                      {template.description}
                    </Text>
                    <View className="flex-row items-center">
                      <Target
                        size={14}
                        color="#5A6E6C"
                        style={{ marginRight: 6 }}
                      />
                      <Text className="text-xs text-dark-sage font-semibold">
                        Target: {template.target}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
