import { cssInterop } from 'nativewind';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable className for all React Native components
cssInterop(View, { className: 'style' });
cssInterop(Text, { className: 'style' });
cssInterop(TextInput, { className: 'style' });
cssInterop(TouchableOpacity, { className: 'style' });
cssInterop(ScrollView, { className: 'style' });
cssInterop(FlatList, { className: 'style' });
cssInterop(Image, { className: 'style' });
cssInterop(Pressable, { className: 'style' });
cssInterop(SafeAreaView, { className: 'style' });

