import { AppNode } from './node.enum';

export enum AppRoutes {
  ROOT = '/',
  PUBLIC = `/${AppNode.PUBLIC}`,
  AUTHENTICATED = `/${AppNode.AUTHENTICATED}`,
  MEMBER = `${AppRoutes.AUTHENTICATED}/${AppNode.MEMBER}`,
  MEMBER_DETAIL = `${AppRoutes.MEMBER}/detail/`,
  SIGN_IN = `/${AppNode.SIGN_IN}`,
}

