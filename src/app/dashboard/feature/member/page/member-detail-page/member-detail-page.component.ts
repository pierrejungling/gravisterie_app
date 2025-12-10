import { Component, computed, inject, Input, OnInit, Signal } from '@angular/core';
import { MemberService } from '../../service/member.service';

@Component({
  selector: 'app-member-detail-page',
  standalone: true,
  imports: [],
  templateUrl: './member-detail-page.component.html',
  styleUrl: './member-detail-page.component.scss'
})
export class MemberDetailPageComponent implements OnInit {
  @Input() id!: string;
  readonly memberService = inject(MemberService);

  detail$: Signal<string> = computed(() => 
    this.memberService.List$().find(m => m === this.id) || 'not found'
  );

  ngOnInit(): void {
    this.setDetail();
  }

  private setDetail(): void {
    this.memberService.setDetail(this.id);
  }
}

