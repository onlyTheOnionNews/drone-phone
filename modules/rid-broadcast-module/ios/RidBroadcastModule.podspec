# RidBroadcastModule.podspec

Pod::Spec.new do |s|
  s.name           = 'RidBroadcastModule'
  s.version        = '1.0.0'
  s.summary        = 'Broadcast remote id over bluetooth'
  s.description    = 'Bluetooth broadcast module for drone remote id'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
