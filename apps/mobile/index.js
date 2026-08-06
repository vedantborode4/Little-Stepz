// Custom entry: load polyfills before expo-router so globals exist
// before react-native initializes.
// react-native-gesture-handler must be imported first (standalone-build
// requirement; Expo Go pre-loads it, which is why it only bites release builds).
import "react-native-gesture-handler";
import "./src/polyfills";
import "expo-router/entry";
