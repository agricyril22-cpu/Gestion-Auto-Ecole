; Page « Mot de passe d'installation » de l'installateur Windows.
; Le mot de passe vient du fichier install-password.nsh, généré au moment de la fabrication
; à partir du secret GitHub AE_INSTALL_PASSWORD (voir tools/prepare-build.mjs). Il n'est jamais dans le dépôt.
!include /NONFATAL "${BUILD_RESOURCES_DIR}\install-password.nsh"

!ifdef AE_PWD
!include nsDialogs.nsh
!include LogicLib.nsh
Var AePwdField

Function AePwdCreate
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 30u "Cette installation est protégée.$\r$\nSaisissez le mot de passe d'installation fourni avec le logiciel."
  Pop $0
  ${NSD_CreatePassword} 0 40u 100% 14u ""
  Pop $AePwdField
  ${NSD_SetFocus} $AePwdField
  nsDialogs::Show
FunctionEnd

Function AePwdLeave
  ${NSD_GetText} $AePwdField $0
  ${If} $0 S!= "${AE_PWD}"
    MessageBox MB_ICONSTOP|MB_OK "Mot de passe incorrect. Vérifiez-le et réessayez."
    Abort
  ${EndIf}
FunctionEnd

!macro customWelcomePage
  Page custom AePwdCreate AePwdLeave
!macroend
!endif
