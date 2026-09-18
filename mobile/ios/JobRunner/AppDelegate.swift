import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    // Window is created here (not only in SceneDelegate) because
    // expo-dev-launcher's app-delegate subscriber runs synchronously during
    // didFinishLaunching — before any scene connects — and fatal-errors if
    // `UIApplication.shared.delegate?.window` isn't already set. SceneDelegate
    // reuses this same window (assigns it to the connecting scene) instead of
    // creating a second one, which is what satisfies the iOS 27 scene-adoption
    // check.
    let window = UIWindow(frame: UIScreen.main.bounds)
    self.window = window
    window.makeKeyAndVisible()
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

#if os(iOS) || os(tvOS)
  // Required once UIApplicationSceneManifest is declared — tells UIKit which
  // scene delegate to instantiate for a new window scene. This satisfies an
  // optional UIApplicationDelegate protocol requirement (via ExpoAppDelegate's
  // conformance), not a superclass method, so no `override`.
  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
#endif

  // Linking API — still handled here for app-delegate-level callers; the
  // scene-based equivalents in SceneDelegate cover the normal foreground path.
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

#if os(iOS) || os(tvOS)
/**
 Minimal scene delegate adopting the UIScene lifecycle iOS 27 requires.
 Creates the window and starts React Native here instead of in
 AppDelegate.didFinishLaunchingWithOptions — that's what a scene-based app
 expects, and skipping it is what caused the hard launch crash on iOS 27.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    // Reuse the window AppDelegate already created (and started React
    // Native in) during didFinishLaunching — don't allocate a second one.
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let window = appDelegate.window else {
      return
    }

    window.windowScene = windowScene
    self.window = window

    // Cold-start deep link (app not running yet, opened via a URL).
    if let url = connectionOptions.urlContexts.first?.url {
      RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
    // Cold-start universal link (app not running yet, opened via Handoff/Siri/Spotlight).
    if let userActivity = connectionOptions.userActivities.first {
      RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
  }

  // Foreground deep link — app already running, user tapped a link.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  // Foreground universal link.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
#endif

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
