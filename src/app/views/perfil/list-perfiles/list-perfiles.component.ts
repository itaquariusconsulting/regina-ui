import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Response } from '../../../models/response';
import { RegSecProfile } from '../../../models/reg-sec-profile';
import { RegSecProfileService } from '../../../services/reg-sec-profile.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-list-perfiles',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './list-perfiles.component.html',
  styleUrl: './list-perfiles.component.scss'
})
export class ListPerfilesComponent implements OnInit {
  constructor(private profileService: RegSecProfileService,
    private router: Router,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;
  profiles: RegSecProfile[] = [];

  ngOnInit(): void {
    this.getProfiles();
  }

  getProfiles() {
    this.profileService.getRegSecProfiles().subscribe({
      next: (response: Response) => {
        this.profiles = response.resultado;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  onNewProfile() {
    this.router.navigate(['/edit-perfil']);
  }
}
