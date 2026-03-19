import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { RegSecUserService } from '../../../services/reg-sec-user.service';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';

@Component({
  selector: 'app-edit-usuario',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './edit-usuario.component.html',
  styleUrl: './edit-usuario.component.scss'
})
export class EditUsuarioComponent implements OnInit {
  userId!: number;
  username: string = '';
  userLastName: string = '';
  userMiddleName: string = '';
  userFirstName: string = '';
  userStatus: string = '';
  userProfileName: string = '';
  isLoading$: Observable<boolean>;

  constructor(
    private userService: RegSecUserService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private location: Location,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.userId = +id;
      this.loadUserData();
    }
  }

  loadUserData(): void {
    this.loadingService.show();
    this.userService.getUserById(this.userId).subscribe({
      next: (res) => {
        const data = res.resultado;
        this.username = data.userUsername;
        this.userLastName = data.userLastName;
        this.userMiddleName = data.userMiddleName;
        this.userFirstName = data.userName;
        this.userStatus = data.userStatus;
        this.userProfileName = data.profileShortName;
        this.loadingService.hide()
      },
      error: () => this.loadingService.hide()
    });
  }

  onBack(): void {
    this.location.back();
  }
}
