import { Location } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, delay } from 'rxjs';
import { ErrorService } from 'src/app/core/services/error.service';
import { LoadingService } from 'src/app/core/services/loading.service';
import { UserService } from 'src/app/core/services/user.service';

@Component({
  selector: 'app-login-cadastro',
  templateUrl: './login-cadastro.component.html',
  styleUrls: ['./login-cadastro.component.scss']
})
export class LoginCadastroComponent implements OnInit {

  /**
   * Campos login
   */
  cpfFormControl: FormControl = new FormControl<string>('', [Validators.required]);
  senhaFormControl: FormControl = new FormControl<string>('', [Validators.required]);

  /**
   * Form cadastro
   */
  formBuilder: FormBuilder = new FormBuilder();
  cadastroForm!: FormGroup;

  enviadoLogin: boolean = false;

  enviadoCadastro: boolean = false;

  cadastro: boolean = false;
  mostrarSenha: boolean = false;

  isLoading: boolean = false;

  errorMessage: string = '';

  private cadastroSub: Subject<any> = new Subject();

  private loginSub: Subject<any> = new Subject();

  constructor(private userService: UserService, private loadingService: LoadingService, private router: Router, private location: Location, private errorService: ErrorService) {

  }

  ngOnInit(): void {

    this.cadastroUserValidators();

    this.loadingService.loadingSub.pipe(delay(0))
      .subscribe((loading) => {
        this.isLoading = loading;
      });

    const cadastroSubDebounce = this.cadastroSub.pipe(debounceTime(1000));
    const loginSubDebounce = this.loginSub.pipe(debounceTime(1000));

    cadastroSubDebounce.subscribe({
      next: (payload: any) => {
        this.userService.cadastrarCasual(payload).subscribe({
          next: _ => {
            this.cpfFormControl.patchValue(this.cadastroForm.get('cpf')!.value);
            this.senhaFormControl.patchValue(this.cadastroForm.get('senha')!.value);
            this.cadastro = false;
            this.moveScroll();
          },
          error: (err) => {

            this.errorMessage = err.error.message

            if (err.error?.body) {
              this.errorMessage = err.error.body.cpf
            } else if (this.errorMessage.includes('duplicate key') && this.errorMessage.includes('cpf')) {
              this.errorMessage = 'O CPF informado já foi cadastrado no sistema';
            }

            this.errorService.errorSub.next(true);
          }
        });
      }
    });

    loginSubDebounce.subscribe({
      next: (value) => {
        this.userService.autenticar(value).subscribe({
          next: (response) => {
            localStorage.setItem('dadosLogin', JSON.stringify(response));
            this.userService.dadosLogin.next(response);
            this.router.navigate(['/modulo']);
          },
          error: (err) => {
            this.errorMessage = err.error.message;
            if (err.error?.body) {
              this.errorMessage = err.error.body.cpf
            } else if (err.error.message) {
              this.errorMessage = err.error.message;
            } else {
              this.errorMessage = err.error;
            }

            this.errorService.errorSub.next(true);

          }
        });
      }
    })



    this.cadastroForm = this.formBuilder.group({
      nomeCompleto: [null, Validators.required],
      dataNascimento: [null, Validators.required],
      cpf: [null, Validators.required],
      senha: [null, Validators.required],
      email: [null, [Validators.required, Validators.email]],
      termosUso: [null, Validators.requiredTrue]
    })
  }

  cadastroUserValidators() {
    this.cadastroForm = this.formBuilder.group({
      nomeCompleto: [null, [Validators.required, Validators.minLength(3)]],
      dataNascimento: [null, [Validators.required, Validators.maxLength(10)]],
      cpf: [null, [Validators.required]],
      email: [null, [Validators.required, Validators.email]],
      senha: [null, [Validators.required, Validators.minLength(8)]],
      termosUso: [false, Validators.requiredTrue]
    })
  }


  login() {
    this.enviadoLogin = true;

    // Validar os campos CPF e senha
    if (this.cpfFormControl.valid && this.senhaFormControl.valid) {
      const dadosLogin = {
        cpf: this.cpfFormControl.value,
        senha: this.senhaFormControl.value
      };

      this.loginSub.next(dadosLogin);

    } else {
      // Marcar os campos inválidos
      if (this.cpfFormControl.invalid) {
        this.cpfFormControl.markAsDirty();
        this.cpfFormControl.markAsTouched();
      }

      if (this.senhaFormControl.invalid) {
        this.senhaFormControl.markAsDirty();
        this.senhaFormControl.markAsTouched();
      }
    }
  }

  cadastrar() {
    this.enviadoCadastro = true;

    // Validar os campos do formulário de cadastro
    if (this.cadastroForm.valid) {
      const dataArr = (this.cadastroForm.get('dataNascimento')?.value as string).split('/');
      const dataAmericana = dataArr.reverse().join('-');

      if (this.validarIdadeMinima(dataAmericana)) {
        this.cadastroSub.next({ ...this.cadastroForm.value, dataNascimento: dataAmericana });
      } else {
        this.errorMessage = 'A idade mínima para se cadastrar no sistema é de 12 anos'
        this.errorService.errorSub.next(true);
      }

    } else {

      Object.keys(this.cadastroForm.controls).forEach(key => {
        const control = this.cadastroForm.get(key);
        if (control && control.invalid) {
          control.markAsDirty();
          control.markAsTouched();
        }
      });

    }
  }

  formatNomeCompleto(event: Event) {
    const input = event.target as HTMLInputElement;
    let nomeCompleto = input.value;

    nomeCompleto = nomeCompleto.replace(/[^a-zA-Z\s]/g, '');

    input.value = nomeCompleto;
  }

  // Validação de idade mínima

  validarIdadeMinima(data: string): boolean {
    const dataNascimento = new Date(data);

    if (!dataNascimento || isNaN(dataNascimento.getTime())) {
      return false;
    }

    const dataAtual = new Date();
    const diffAnos = dataAtual.getFullYear() - dataNascimento.getFullYear();

    return diffAnos >= 12;

  }

  moveScroll() {
    if (window.innerWidth < 1000) {
      if (this.cadastro) {
        document.getElementById('container')!.scrollTop = document.getElementById('container')!.scrollHeight / 1.8;
      } else {
        document.getElementById('container')!.scrollTop = 0;
      }
    }
  }

  goBackOneSCreen() {
    this.location.back();
  }

}