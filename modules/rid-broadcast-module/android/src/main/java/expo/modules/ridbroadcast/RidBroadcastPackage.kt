package expo.modules.ridbroadcastmodule

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RidBroadcastModule : ReactPackage {
    Name("RidBroadcastModule")
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(RidBroadcastModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
