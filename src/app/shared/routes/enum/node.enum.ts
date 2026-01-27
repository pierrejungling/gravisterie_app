export enum AppNode {
  AUTHENTICATED = 'dashboard',
  PUBLIC = 'account',
  REDIRECT_TO_PUBLIC = AppNode.PUBLIC,
  REDIRECT_TO_AUTHENTICATED = AppNode.AUTHENTICATED,
  MEMBER = 'member',
  DETAIL = 'detail/:id',
  SIGN_IN = 'signin',
  SIGN_UP = 'signup',
  COMMANDES = 'commandes',
  NOUVELLE_COMMANDE = 'nouvelle',
  COMMANDES_EN_COURS = 'en-cours',
  COMMANDES_TERMINEES = 'terminees',
  DETAIL_COMMANDE = 'detail/:id',
  FALL_BACK = '**',
}

