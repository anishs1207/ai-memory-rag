import React, { useEffect, useState } from "react";
import { Animated, Image, Text, View } from "react-native";

type AnimatedMascotProps = {
  greeting?: string;
  size?: number;
};

export default function AnimatedMascot({ greeting = "Hello, explorer!", size = 210 }: AnimatedMascotProps) {
  const [bubble] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.spring(bubble, {
      toValue: 1,
      damping: 13,
      stiffness: 150,
      useNativeDriver: true,
    });
    animation.start();
  }, [bubble]);

  return (
    <View className="items-center">
      <Animated.View
        className="px-4 py-2 mb-2 bg-white dark:bg-[#211d27] rounded-2xl border border-[#e9e3f6] dark:border-[#342d3d] shadow-sm"
        style={{
          opacity: bubble,
          transform: [
            { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
            { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        }}
      >
        <Text className="text-[14px] font-semibold text-[#393340] dark:text-white">{greeting}</Text>
      </Animated.View>
      <Image
        source={require("../../../assets/images/inqora-mascot-wave.gif")}
        resizeMode="contain"
        style={{ width: size, height: size }}
        accessibilityLabel="Inqora's friendly corgi space explorer mascot waving hello"
      />
    </View>
  );
}
