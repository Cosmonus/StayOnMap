import { createNativeStackNavigator } from '@react-navigation/native-stack'
import GetStartedScreen from '@features/auth/screens/GetStartedScreen'
import LoginScreen from '@features/auth/screens/LoginScreen'

const Stack = createNativeStackNavigator()

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GetStarted" component={GetStartedScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  )
}
