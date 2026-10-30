import type { CapacitorConfig } from '@capacitor/cli'

// Android-App. Die appId ist nach der ersten Veröffentlichung im Play Store
// nicht mehr änderbar – vor dem ersten Upload final festlegen.
const config: CapacitorConfig = {
  appId: 'de.fitnessbuddy.app',
  appName: 'Fitness',
  webDir: 'dist',
  android: {
    // Inhalte nicht als „gemischt“ blockieren, Debug nur im Debug-Build
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_buddy',
      iconColor: '#E11D48',
    },
  },
}

export default config
