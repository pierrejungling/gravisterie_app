import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  List$: WritableSignal<string[]> = signal(['test user', 'test user2']);
  Detail$: WritableSignal<string> = signal('');

  setDetail(id: string): void {
    this.Detail$.set(id);
  }
}
