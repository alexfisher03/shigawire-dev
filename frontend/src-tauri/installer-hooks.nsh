!macro NSIS_HOOK_PREINSTALL
  ExecWait 'cmd.exe /c taskkill /F /IM Shigawire.exe /T 2>nul & taskkill /F /IM shigawire-server.exe /T 2>nul & exit /b 0'
  Sleep 800
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait 'cmd.exe /c taskkill /F /IM Shigawire.exe /T 2>nul & taskkill /F /IM shigawire-server.exe /T 2>nul & exit /b 0'
  Sleep 800
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Bundle id from tauri.conf.json (app_data_dir / app_local_data_dir)
  RMDir /r "$APPDATA\dev.shigawire.desktop"
  RMDir /r "$LOCALAPPDATA\dev.shigawire.desktop"
  ; Product-name paths used by some bundles / older layouts / installer staging
  RMDir /r "$APPDATA\Shigawire"
  RMDir /r "$LOCALAPPDATA\Shigawire"
!macroend
