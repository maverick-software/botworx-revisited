!include LogicLib.nsh
!include nsDialogs.nsh

!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Sylvana Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard installs Sylvana on your computer.$\r$\n$\r$\nYou can choose the program folder. Existing accounts, chats, settings, credentials, and local data are kept in their existing locations.$\r$\n$\r$\nClose Sylvana before continuing."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  InitPluginsDir
  SetOutPath $PLUGINSDIR
  File /oname=setup-node.exe "${SYLVANA_SETUP_NODE}"
  File /oname=profile-helper.cjs "${SYLVANA_SETUP_HELPER}"
  File /oname=profile-validator.cjs "${SYLVANA_SETUP_VALIDATOR}"
!macroend

!macro customPageAfterChangeDir
  Page custom SylvanaDataPage
  Function SylvanaDataPage
    ${StrContains} $0 "${APP_FILENAME}" $INSTDIR
    ${If} $0 == ""
      StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Keep your existing data" "Only the program location changes."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateLabel} 0 0 100% 65u "Program folder:$\r$\n$INSTDIR$\r$\n$\r$\nYour existing chats, settings, credentials, and local runtime stay where they are. Uninstalling Sylvana will keep personal data."
    Pop $0
    ${NSD_CreateLabel} 0 75u 100% 45u "Setup will show extraction progress and file details. Windows Subsystem for Linux 2 and hardware virtualization are required to run Sylvana’s local services."
    Pop $0
    GetDlgItem $0 $HWNDPARENT 1
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Install"
    nsDialogs::Show
  FunctionEnd
!macroend

!macro customCheckAppRunning
 !ifdef BUILD_UNINSTALLER
  nsExec::ExecToStack '"$INSTDIR\resources\resources\script-runtimes\node-24.22.0\node.exe" "$INSTDIR\resources\resources\setup\profile-helper.cjs" check-running "${SYLVANA_SETUP_HOME}" "${SYLVANA_SETUP_APPDATA}" "$INSTDIR" "$PLUGINSDIR" "${SYLVANA_SETUP_MODE}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "$1"
    SetErrorLevel 2
    Abort
  ${EndIf}
 !else
  SetDetailsPrint both
  DetailPrint "Verifying the existing data location before changing program files..."
  nsExec::ExecToStack '"$PLUGINSDIR\setup-node.exe" "$PLUGINSDIR\profile-helper.cjs" prepare "${SYLVANA_SETUP_HOME}" "${SYLVANA_SETUP_APPDATA}" "$INSTDIR" "$PLUGINSDIR" "${SYLVANA_SETUP_MODE}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "Setup stopped to preserve your existing data.$\r$\n$\r$\n$1"
    SetErrorLevel 2
    Abort
  ${EndIf}
  SetDetailsPrint both
  DetailPrint "Extracting Sylvana program files..."
 !endif
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Registering the program location while preserving personal data..."
  nsExec::ExecToStack '"$PLUGINSDIR\setup-node.exe" "$PLUGINSDIR\profile-helper.cjs" commit "${SYLVANA_SETUP_HOME}" "${SYLVANA_SETUP_APPDATA}" "$INSTDIR" "$PLUGINSDIR" "${SYLVANA_SETUP_MODE}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "Setup could not register the preserved data location.$\r$\n$\r$\n$1$\r$\n$\r$\nYour personal data was not removed."
    SetErrorLevel 2
    Abort
  ${EndIf}
  DetailPrint "Personal data preserved. Sylvana setup is complete."
!macroend

; Remove only paths delivered by this version. A user's extra files in the
; program folder must survive an upgrade or uninstall.
!macro customRemoveFiles
  SetOutPath $TEMP
  !insertmacro SYLVANA_REMOVE_OWNED_FILES
  Delete "$INSTDIR\${UNINSTALL_FILENAME}"
  RMDir "$INSTDIR"
!macroend
